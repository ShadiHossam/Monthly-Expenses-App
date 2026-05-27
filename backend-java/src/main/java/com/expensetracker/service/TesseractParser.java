package com.expensetracker.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@Slf4j
public class TesseractParser {

    private static final List<DateTimeFormatter> DATE_FORMATS = List.of(
        DateTimeFormatter.ofPattern("dd/MM/yyyy"),
        DateTimeFormatter.ofPattern("dd-MM-yyyy"),
        DateTimeFormatter.ofPattern("d/M/yyyy"),
        DateTimeFormatter.ofPattern("dd MMM yyyy"),
        DateTimeFormatter.ofPattern("d MMM yyyy"),
        DateTimeFormatter.ofPattern("dd MMMM yyyy"),
        DateTimeFormatter.ofPattern("yyyy-MM-dd")
    );

    // Matches: 01/01/2024, 1-1-2024, 01 Jan 2024, 2024-01-01
    private static final Pattern DATE_PATTERN = Pattern.compile(
        "\\b(\\d{1,2}[/\\-]\\d{1,2}[/\\-]\\d{4}|\\d{1,2}\\s+[A-Za-z]{3,9}\\s+\\d{4}|\\d{4}-\\d{2}-\\d{2})\\b"
    );

    // Matches signed/unsigned financial amounts:
    // negative integers/decimals (-5, -36.75, -1,631), comma-grouped (16,458.81), plain decimals (36.75)
    private static final Pattern AMOUNT_PATTERN = Pattern.compile(
        "(-\\d{1,3}(?:,\\d{3})*(?:\\.\\d{1,2})?|-\\d+(?:\\.\\d{1,2})?|\\d{1,3}(?:,\\d{3})+(?:\\.\\d{1,2})?|\\d+\\.\\d{1,2})\\s*(CR|DR)?\\b",
        Pattern.CASE_INSENSITIVE
    );

    public String extractText(byte[] imageBytes, String mimeType) {
        Path tempImage = null;
        Path tempOutput = null;
        try {
            String ext = mimeType != null && mimeType.contains("png") ? ".png" : ".jpg";
            tempImage = Files.createTempFile("ocr_in_", ext);
            Files.write(tempImage, imageBytes);
            tempOutput = Files.createTempFile("ocr_out_", "");

            ProcessBuilder pb = new ProcessBuilder(
                "tesseract", tempImage.toString(), tempOutput.toString(),
                "-l", "eng", "--psm", "3"
            );
            pb.redirectErrorStream(true);
            Process process = pb.start();
            boolean finished = process.waitFor(30, TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                throw new RuntimeException("Tesseract timed out after 30 seconds");
            }
            String processOutput = new String(process.getInputStream().readAllBytes());
            int exitCode = process.exitValue();

            if (exitCode != 0) {
                throw new RuntimeException("Tesseract exited with code " + exitCode + ": " + processOutput);
            }

            Path txtFile = Path.of(tempOutput + ".txt");
            String text = Files.readString(txtFile);
            Files.deleteIfExists(txtFile);
            log.debug("Tesseract extracted {} chars", text.length());
            return text;
        } catch (Exception e) {
            throw new RuntimeException("Tesseract OCR failed: " + e.getMessage(), e);
        } finally {
            try { if (tempImage != null) Files.deleteIfExists(tempImage); } catch (Exception ignored) {}
            try { if (tempOutput != null) Files.deleteIfExists(tempOutput); } catch (Exception ignored) {}
        }
    }

    public List<OcrService.TransactionDTO> parse(String rawText) {
        List<OcrService.TransactionDTO> results = new ArrayList<>();

        for (String line : rawText.split("\\n")) {
            String trimmed = line.trim();
            if (trimmed.length() < 10) continue;

            Matcher dateMatcher = DATE_PATTERN.matcher(trimmed);
            if (!dateMatcher.find()) continue;

            LocalDate date = parseDate(dateMatcher.group(1));
            if (date == null) continue;

            List<AmountToken> amounts = new ArrayList<>();
            Matcher amountMatcher = AMOUNT_PATTERN.matcher(trimmed);
            while (amountMatcher.find()) {
                String raw = amountMatcher.group(1).replace(",", "");
                boolean negative = raw.startsWith("-");
                BigDecimal num = new BigDecimal(raw.replace("-", ""));
                amounts.add(new AmountToken(num, amountMatcher.group(2), amountMatcher.start(), negative));
            }
            if (amounts.isEmpty()) continue;

            // Description: text between end of date and start of first amount
            int firstAmtStart = amounts.get(0).pos();
            String description = trimmed.substring(dateMatcher.end(), Math.min(firstAmtStart, trimmed.length())).trim();
            if (description.isBlank()) {
                // fallback: text before the date
                description = trimmed.substring(0, dateMatcher.start()).trim();
            }
            if (description.isBlank()) description = trimmed;

            // Last amount = balance_after (if 2+), second-to-last = transaction amount
            AmountToken txn = amounts.size() >= 2 ? amounts.get(amounts.size() - 2) : amounts.get(0);
            BigDecimal balance = amounts.size() >= 2 ? amounts.get(amounts.size() - 1).amount() : null;

            String type = resolveType(txn, amounts, trimmed);

            results.add(new OcrService.TransactionDTO(
                date.toString(), description, txn.amount(), type, balance, null
            ));
        }

        log.info("Tesseract regex parser found {} transactions", results.size());
        return results;
    }

    private String resolveType(AmountToken txn, List<AmountToken> amounts, String line) {
        // Negative sign is the most reliable indicator (UAE bank format uses - for debits)
        if (txn.negative()) return "debit";
        if ("CR".equalsIgnoreCase(txn.crdr())) return "credit";
        if ("DR".equalsIgnoreCase(txn.crdr())) return "debit";
        for (AmountToken t : amounts) {
            if ("CR".equalsIgnoreCase(t.crdr())) return "credit";
        }
        String upper = line.toUpperCase();
        if (upper.contains(" CR ") || upper.endsWith(" CR") || upper.contains("CREDIT")) return "credit";
        // Positive unsigned amount with no keywords = credit (e.g. incoming transfer)
        return "credit";
    }

    private LocalDate parseDate(String raw) {
        String normalized = raw.trim().replaceAll("\\s+", " ");
        for (DateTimeFormatter fmt : DATE_FORMATS) {
            try {
                return LocalDate.parse(normalized, fmt);
            } catch (Exception ignored) {}
        }
        return null;
    }

    private record AmountToken(BigDecimal amount, String crdr, int pos, boolean negative) {}
}
