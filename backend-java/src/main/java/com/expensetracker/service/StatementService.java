package com.expensetracker.service;

import com.expensetracker.config.AppProperties;
import com.expensetracker.dto.response.StatementOut;
import com.expensetracker.exception.BusinessException;
import com.expensetracker.exception.EntityNotFoundException;
import com.expensetracker.exception.QuotaExceededException;
import com.expensetracker.model.Statement;
import com.expensetracker.model.Subscription;
import com.expensetracker.model.Transaction;
import com.expensetracker.model.UsageLog;
import com.expensetracker.model.User;
import com.expensetracker.repository.StatementRepository;
import com.expensetracker.repository.SubscriptionRepository;
import com.expensetracker.repository.TransactionRepository;
import com.expensetracker.repository.UsageLogRepository;
import com.expensetracker.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.PDFRenderer;
import com.expensetracker.exception.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@Service
@RequiredArgsConstructor
@Slf4j
public class StatementService {

    private final StatementRepository statementRepository;
    private final TransactionRepository transactionRepository;
    private final SubscriptionRepository subscriptionRepository;
    private final UsageLogRepository usageLogRepository;
    private final UserRepository userRepository;
    private final OcrService ocrService;
    private final MerchantService merchantService;
    private final SseEmitterRegistry sseRegistry;
    private final AppProperties appProperties;

    private final ConcurrentHashMap<Long, AtomicInteger> activeProcessing = new ConcurrentHashMap<>();

    @Transactional
    public Map<String, Object> upload(MultipartFile file, Long userId, boolean confirmOverage) throws IOException {
        String originalFilename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "upload";
        String ext = originalFilename.contains(".")
                ? originalFilename.substring(originalFilename.lastIndexOf('.') + 1).toLowerCase()
                : "jpg";

        if (!Set.of("jpg", "jpeg", "png", "pdf").contains(ext)) {
            throw new BusinessException("Only JPG, PNG, and PDF files are supported", HttpStatus.BAD_REQUEST);
        }

        boolean isPdf = "pdf".equals(ext);

        // Enforce per-user concurrent processing limit
        User uploadUser = userRepository.findById(userId)
                .orElseThrow(() -> new EntityNotFoundException("User not found"));
        int limit = uploadUser.getConcurrentProcessing();
        AtomicInteger active = activeProcessing.computeIfAbsent(userId, k -> new AtomicInteger(0));
        if (active.get() >= limit) {
            throw new BusinessException(
                "Too many uploads in progress (limit: " + limit + "). Wait for current uploads to finish.",
                HttpStatus.TOO_MANY_REQUESTS);
        }

        Subscription sub = subscriptionRepository.findByUserId(userId)
                .orElseThrow(() -> new EntityNotFoundException("Subscription not found"));

        int remaining = sub.getPagesLimit() - sub.getPagesUsed();
        if (remaining <= 0) {
            boolean overageAvailable = "business".equals(sub.getPlan());
            if (!overageAvailable || !confirmOverage) {
                throw new QuotaExceededException(
                    "Monthly page limit reached (" + sub.getPagesLimit() + " pages)",
                    overageAvailable
                );
            }
        }

        // Save file(s)
        Path userDir = Paths.get(appProperties.getUpload().getDir(), userId.toString());
        Files.createDirectories(userDir);

        List<Long> statementIds = new ArrayList<>();

        if (isPdf) {
            // Load PDF once — renders pages and derives page count in a single pass
            List<BufferedImage> pages = renderPdf(file);
            int pageCount = pages.size();
            for (int i = 0; i < pages.size(); i++) {
                String uuid = UUID.randomUUID().toString();
                Path imgPath = userDir.resolve(uuid + ".png");
                ImageIO.write(pages.get(i), "PNG", imgPath.toFile());

                Statement stmt = Statement.builder()
                        .userId(userId)
                        .filename(originalFilename + " (page " + (i + 1) + ")")
                        .imagePath(imgPath.toString())
                        .build();
                stmt = statementRepository.save(stmt);
                statementIds.add(stmt.getId());

                subscriptionRepository.incrementPagesUsed(userId, 1);
                usageLogRepository.save(UsageLog.builder()
                        .userId(userId).statementId(stmt.getId()).pagesConsumed(1).build());
            }

            List<Long> finalIds = List.copyOf(statementIds);
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    for (Long sid : finalIds) processStatementAsync(sid);
                }
            });

            return Map.of("data", Map.of("statement_ids", statementIds, "page_count", pageCount));
        } else {
            String uuid = UUID.randomUUID().toString();
            Path filePath = userDir.resolve(uuid + "." + ext);
            file.transferTo(filePath);

            Statement stmt = Statement.builder()
                    .userId(userId)
                    .filename(originalFilename)
                    .imagePath(filePath.toString())
                    .build();
            stmt = statementRepository.save(stmt);
            Long statementId = stmt.getId();

            subscriptionRepository.incrementPagesUsed(userId, 1);
            usageLogRepository.save(UsageLog.builder()
                    .userId(userId).statementId(statementId).pagesConsumed(1).build());

            Long finalStatementId = statementId;
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    processStatementAsync(finalStatementId);
                }
            });

            return Map.of("data", Map.of(
                "statement_id", statementId,
                "stream_url", "/api/v1/statements/" + statementId + "/progress"
            ));
        }
    }

    @Async
    public void processStatementAsync(Long statementId) {
        Long userId = null;
        try {
            Statement stmt = statementRepository.findById(statementId)
                    .orElseThrow(() -> new EntityNotFoundException("Statement not found"));
            User user = userRepository.findById(stmt.getUserId())
                    .orElseThrow(() -> new EntityNotFoundException("User not found"));
            userId = user.getId();
            activeProcessing.computeIfAbsent(userId, k -> new AtomicInteger(0)).incrementAndGet();

            sendProgress(statementId, 10, "Loading image", "preprocessing");

            // Read image bytes and resize to max 1500px to reduce AI payload size
            Path imagePath = Paths.get(stmt.getImagePath());
            byte[] imageBytes = Files.readAllBytes(imagePath);
            String mimeType = stmt.getImagePath().endsWith(".png") ? "image/png" : "image/jpeg";
            imageBytes = resizeIfNeeded(imageBytes, mimeType, 1500);

            sendProgress(statementId, 50, "Extracting transactions with AI", "ocr");

            List<OcrService.TransactionDTO> extracted = ocrService.extract(imageBytes, mimeType, user);
            stmt.setRawOcrText("Extracted " + extracted.size() + " transactions via vision AI");

            sendProgress(statementId, 75, "Verifying and processing transactions", "parsing");

            // Build Transaction entities, deduplicate
            List<Transaction> toSave = new ArrayList<>();
            LocalDate minDate = null, maxDate = null;
            BigDecimal firstBalance = null, lastBalance = null;

            for (OcrService.TransactionDTO dto : extracted) {
                LocalDate date;
                try { date = dto.parsedDate(); } catch (Exception e) { continue; }

                if (transactionRepository.existsByUserIdAndTxnDateAndAmountAndDescriptionAndTxnType(
                        stmt.getUserId(), date, dto.amount(), dto.description(),
                        normalizeType(dto.type()))) {
                    continue; // duplicate
                }

                Transaction tx = Transaction.builder()
                        .userId(stmt.getUserId())
                        .statementId(statementId)
                        .txnDate(date)
                        .description(dto.description() != null ? dto.description() : "")
                        .amount(dto.amount() != null ? dto.amount().abs() : BigDecimal.ZERO)
                        .txnType(normalizeType(dto.type()))
                        .balanceAfter(dto.balance_after())
                        .refNumber(dto.ref_number())
                        .build();
                toSave.add(tx);

                if (minDate == null || date.isBefore(minDate)) minDate = date;
                if (maxDate == null || date.isAfter(maxDate)) maxDate = date;
                if (firstBalance == null && dto.balance_after() != null) firstBalance = dto.balance_after();
                if (dto.balance_after() != null) lastBalance = dto.balance_after();
            }

            sendProgress(statementId, 88, "Applying merchant rules", "categorizing");

            merchantService.applyMerchantRules(toSave, stmt.getUserId());
            transactionRepository.saveAll(toSave);

            stmt.setPeriodStart(minDate);
            stmt.setPeriodEnd(maxDate);
            stmt.setClosingBalance(lastBalance);
            stmt.setVerifyStatus("passed");
            stmt.setOcrEngine("vision-ai");
            statementRepository.save(stmt);

            // Overlap detection: check if any other statement covers this period
            Map<String, Object> completePayload = new java.util.LinkedHashMap<>();
            completePayload.put("statement_id", statementId);
            completePayload.put("transaction_count", toSave.size());
            completePayload.put("verify_status", "passed");
            if (minDate != null && maxDate != null) {
                final LocalDate finalMinDate = minDate;
                final LocalDate finalMaxDate = maxDate;
                boolean overlaps = statementRepository.findByUserIdOrderByCreatedAtDesc(stmt.getUserId())
                        .stream()
                        .filter(s -> !s.getId().equals(statementId))
                        .filter(s -> s.getPeriodStart() != null && s.getPeriodEnd() != null)
                        .anyMatch(s ->
                                !s.getPeriodEnd().isBefore(finalMinDate) && !s.getPeriodStart().isAfter(finalMaxDate));
                if (overlaps) {
                    completePayload.put("overlap_warning", Map.of(
                            "period", minDate + " to " + maxDate,
                            "message", "This statement period overlaps with an existing statement. Duplicate transactions are skipped automatically."
                    ));
                }
            }

            sendProgress(statementId, 100, "Complete", "categorizing");
            sseRegistry.send(statementId, "complete", completePayload);
            sseRegistry.complete(statementId);

        } catch (Exception e) {
            log.error("Statement processing failed for id {}: {}", statementId, e.getMessage(), e);
            try {
                Statement stmt = statementRepository.findById(statementId).orElse(null);
                if (stmt != null) {
                    stmt.setVerifyStatus("failed");
                    statementRepository.save(stmt);
                }
            } catch (Exception ignored) {}
            sseRegistry.send(statementId, "error", Map.of("message", e.getMessage()));
            sseRegistry.completeWithError(statementId, e);
        } finally {
            if (userId != null) {
                AtomicInteger counter = activeProcessing.get(userId);
                if (counter != null) counter.decrementAndGet();
            }
        }
    }

    public SseEmitter getProgressEmitter(Long statementId) {
        return sseRegistry.getOrCreate(statementId);
    }

    public List<StatementOut> listStatements(Long userId) {
        return statementRepository.findByUserIdOrderByCreatedAtDesc(userId)
                .stream()
                .map(s -> toOut(s, transactionRepository.countByStatementId(s.getId())))
                .toList();
    }

    public StatementOut getStatement(Long statementId, Long userId) {
        Statement s = statementRepository.findByIdAndUserId(statementId, userId)
                .orElseThrow(() -> new EntityNotFoundException("Statement not found"));
        return toOut(s, transactionRepository.countByStatementId(s.getId()));
    }

    @Transactional
    public void deleteStatement(Long statementId, Long userId) {
        Statement stmt = statementRepository.findByIdAndUserId(statementId, userId)
                .orElseThrow(() -> new EntityNotFoundException("Statement not found"));
        if (stmt.getImagePath() != null) {
            try { Files.deleteIfExists(Paths.get(stmt.getImagePath())); } catch (IOException ignored) {}
        }
        statementRepository.delete(stmt);
    }

    @Transactional
    public StatementOut reverify(Long statementId, Long userId) {
        Statement stmt = statementRepository.findByIdAndUserId(statementId, userId)
                .orElseThrow(() -> new EntityNotFoundException("Statement not found"));
        stmt.setVerifyStatus("pending");
        statementRepository.save(stmt);
        processStatementAsync(statementId);
        return toOut(stmt, transactionRepository.countByStatementId(statementId));
    }

    @Transactional
    public Map<String, Object> reverifyAllPending(Long userId) {
        List<Statement> stuck = statementRepository.findByUserIdAndVerifyStatusIn(
                userId, List.of("pending", "failed"));
        for (Statement stmt : stuck) {
            stmt.setVerifyStatus("pending");
            statementRepository.save(stmt);
        }
        List<Long> ids = stuck.stream().map(Statement::getId).toList();
        // kick off async processing after the transaction commits
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                for (Long sid : ids) processStatementAsync(sid);
            }
        });
        return Map.of("queued", ids.size());
    }

    private void sendProgress(Long statementId, int pct, String message, String step) {
        sseRegistry.send(statementId, "progress", Map.of("percentage", pct, "message", message, "step", step));
    }

    private String normalizeType(String type) {
        if (type == null) return "debit";
        String t = type.toLowerCase().trim();
        return t.contains("credit") ? "credit" : "debit";
    }

    private List<BufferedImage> renderPdf(MultipartFile file) throws IOException {
        try (PDDocument doc = Loader.loadPDF(file.getInputStream().readAllBytes())) {
            PDFRenderer renderer = new PDFRenderer(doc);
            List<BufferedImage> pages = new ArrayList<>();
            for (int i = 0; i < doc.getNumberOfPages(); i++) {
                pages.add(renderer.renderImageWithDPI(i, 150, org.apache.pdfbox.rendering.ImageType.RGB));
            }
            return pages;
        }
    }

    private byte[] resizeIfNeeded(byte[] imageBytes, String mimeType, int maxDimension) {
        try {
            java.awt.image.BufferedImage img = javax.imageio.ImageIO.read(new java.io.ByteArrayInputStream(imageBytes));
            if (img == null) return imageBytes;
            int w = img.getWidth(), h = img.getHeight();
            if (w <= maxDimension && h <= maxDimension) return imageBytes;

            double scale = (double) maxDimension / Math.max(w, h);
            int newW = (int) (w * scale), newH = (int) (h * scale);

            // Always use TYPE_INT_RGB — avoids color model mismatches in headless containers
            java.awt.image.BufferedImage resized = new java.awt.image.BufferedImage(newW, newH, java.awt.image.BufferedImage.TYPE_INT_RGB);
            java.awt.Graphics2D g = resized.createGraphics();
            g.setRenderingHint(java.awt.RenderingHints.KEY_INTERPOLATION, java.awt.RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            g.setRenderingHint(java.awt.RenderingHints.KEY_RENDERING, java.awt.RenderingHints.VALUE_RENDER_QUALITY);
            g.setColor(java.awt.Color.WHITE);
            g.fillRect(0, 0, newW, newH);  // white background before drawing (handles transparency correctly)
            g.drawImage(img, 0, 0, newW, newH, null);
            g.dispose();

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            String format = mimeType.contains("png") ? "PNG" : "JPEG";
            javax.imageio.ImageIO.write(resized, format, out);
            log.debug("Resized image from {}x{} to {}x{}", w, h, newW, newH);
            return out.toByteArray();
        } catch (Exception e) {
            log.warn("Image resize failed, using original: {}", e.getMessage());
            return imageBytes;
        }
    }

    private StatementOut toOut(Statement s, long txCount) {
        return StatementOut.builder()
                .id(s.getId()).userId(s.getUserId()).filename(s.getFilename())
                .imagePath(s.getImagePath()).periodStart(s.getPeriodStart()).periodEnd(s.getPeriodEnd())
                .openingBalance(s.getOpeningBalance()).closingBalance(s.getClosingBalance())
                .verifyStatus(s.getVerifyStatus()).verifyErrors(s.getVerifyErrors())
                .confidence(s.getConfidence()).ocrEngine(s.getOcrEngine())
                .createdAt(s.getCreatedAt()).transactionCount(txCount)
                .build();
    }
}
