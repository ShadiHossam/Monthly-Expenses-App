package com.expensetracker.service;

import com.expensetracker.exception.BusinessException;
import com.expensetracker.exception.QuotaExceededException;
import com.expensetracker.model.GmailFilterSender;
import com.expensetracker.model.GmailProcessedMessage;
import com.expensetracker.model.User;
import com.expensetracker.repository.GmailFilterSenderRepository;
import com.expensetracker.repository.GmailProcessedMessageRepository;
import com.expensetracker.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Slf4j
@RequiredArgsConstructor
public class GmailPollerService {

    private final UserRepository userRepository;
    private final GmailFilterSenderRepository senderRepo;
    private final GmailProcessedMessageRepository processedRepo;
    private final GmailService gmailService;
    private final StatementService statementService;

    /**
     * Runs at 07:00 every day. @Async prevents blocking the Spring scheduler thread
     * during slow Gmail API calls (app uses @EnableAsync on Application).
     */
    @Scheduled(cron = "0 0 7 * * *")
    @Async
    public void scheduledSync() {
        gmailService.cleanExpiredStates();
        int today = LocalDate.now().getDayOfMonth();
        List<User> users = userRepository.findAllByGmailRefreshTokenNotNull();
        for (User user : users) {
            if (parseSyncDays(user.getGmailSyncDays()).contains(today)) {
                syncUser(user);
            }
        }
    }

    /** Manual trigger for a single user — called by GmailController "Sync Now". */
    public int syncUserById(Long userId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("User not found"));
        if (user.getGmailRefreshToken() == null) {
            throw new RuntimeException("Gmail not connected");
        }
        return syncUser(user);
    }

    private int syncUser(User user) {
        try {
            String accessToken = gmailService.refreshAccessToken(user.getGmailRefreshToken());
            if (accessToken == null) {
                log.warn("Gmail refresh token revoked for user {} — disconnecting", user.getId());
                user.setGmailRefreshToken(null);
                user.setGmailEmail(null);
                userRepository.save(user);
                return 0;
            }
            List<GmailFilterSender> senders = senderRepo.findByUserId(user.getId());
            if (senders.isEmpty()) {
                log.info("User {} has no Gmail sender filters — skipping sync", user.getId());
                return 0;
            }
            int imported = 0;
            for (GmailFilterSender sender : senders) {
                imported += syncSender(user, accessToken, sender.getSenderEmail());
            }
            log.info("Gmail sync for user {}: imported {} statement(s)", user.getId(), imported);
            return imported;
        } catch (Exception e) {
            log.error("Gmail sync failed for user {}: {}", user.getId(), e.getMessage(), e);
            return 0;
        }
    }

    // No @Transactional — called from private syncUser(), so Spring AOP proxy would bypass it.
    // statementService.upload() and processedRepo.save() each manage their own transactions.
    public int syncSender(User user, String accessToken, String senderEmail) {
        int count = 0;
        List<String> messageIds = gmailService.listMessageIds(accessToken, senderEmail);
        for (String msgId : messageIds) {
            if (processedRepo.existsByUserIdAndGmailMessageId(user.getId(), msgId)) continue;
            List<Map<String, String>> attachments = gmailService.listAttachments(accessToken, msgId);
            for (Map<String, String> att : attachments) {
                try {
                    byte[] bytes = gmailService.downloadAttachment(accessToken, msgId, att.get("attachmentId"));
                    var multipart = new InMemoryMultipartFile(
                        att.get("filename"), bytes, att.get("mimeType"));
                    statementService.upload(multipart, user.getId(), false);
                    count++;
                } catch (QuotaExceededException e) {
                    log.warn("User {} quota exceeded during Gmail sync — aborting this sync run", user.getId());
                    return count;
                } catch (BusinessException e) {
                    log.warn("Upload skipped for message {} ({}): {}", msgId, att.get("filename"), e.getMessage());
                    return count;
                } catch (Exception e) {
                    log.warn("Failed to import attachment '{}' from message {}: {}",
                        att.get("filename"), msgId, e.getMessage());
                }
            }
            processedRepo.save(GmailProcessedMessage.builder()
                .userId(user.getId())
                .gmailMessageId(msgId)
                .build());
        }
        return count;
    }

    private Set<Integer> parseSyncDays(String syncDays) {
        if (syncDays == null || syncDays.isBlank()) return Set.of();
        return Arrays.stream(syncDays.split(","))
            .map(String::trim)
            .filter(s -> !s.isEmpty())
            .map(Integer::parseInt)
            .collect(Collectors.toSet());
    }
}
