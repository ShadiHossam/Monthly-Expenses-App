package com.expensetracker.service;

import com.expensetracker.config.AppProperties;
import com.expensetracker.model.GmailOauthState;
import com.expensetracker.repository.GmailOauthStateRepository;
import com.expensetracker.repository.UserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import org.springframework.web.util.UriComponentsBuilder;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.*;

@Service
@Slf4j
public class GmailService {

    private final AppProperties appProperties;
    private final WebClient webClient;
    private final GmailOauthStateRepository stateRepo;
    private final UserRepository userRepository;

    // Manual constructor required — @RequiredArgsConstructor can't place @Qualifier on parameters
    public GmailService(AppProperties appProperties,
                        @Qualifier("googleClient") WebClient webClient,
                        GmailOauthStateRepository stateRepo,
                        UserRepository userRepository) {
        this.appProperties = appProperties;
        this.webClient = webClient;
        this.stateRepo = stateRepo;
        this.userRepository = userRepository;
    }

    private static final String TOKEN_URL    = "https://oauth2.googleapis.com/token";
    private static final String USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
    private static final String GMAIL_BASE   = "https://gmail.googleapis.com/gmail/v1/users/me";
    private static final String AUTH_BASE    = "https://accounts.google.com/o/oauth2/v2/auth";
    private static final String SCOPE        = "https://www.googleapis.com/auth/gmail.readonly";

    /**
     * Generate a random UUID state nonce, store it in DB with 10-min TTL,
     * and return the Google authorization URL containing that state.
     */
    @Transactional
    public String buildAuthUrl(Long userId) {
        String state = UUID.randomUUID().toString();
        stateRepo.save(GmailOauthState.builder()
            .state(state)
            .userId(userId)
            .expiresAt(OffsetDateTime.now().plusMinutes(10))
            .build());
        AppProperties.Gmail cfg = appProperties.getGmail();
        return UriComponentsBuilder.fromHttpUrl(AUTH_BASE)
            .queryParam("client_id", cfg.getClientId())
            .queryParam("redirect_uri", cfg.getRedirectUri())
            .queryParam("response_type", "code")
            .queryParam("scope", SCOPE)
            .queryParam("access_type", "offline")
            .queryParam("prompt", "consent")
            .queryParam("state", state)
            .build().toUriString();
    }

    /**
     * Validate the state nonce from the OAuth callback.
     * Throws if expired/unknown. Deletes the nonce on success (single-use).
     */
    @Transactional
    public Long validateAndConsumeState(String state) {
        GmailOauthState record = stateRepo
            .findByStateAndExpiresAtAfter(state, OffsetDateTime.now())
            .orElseThrow(() -> new RuntimeException("Invalid or expired OAuth state"));
        stateRepo.delete(record);
        return record.getUserId();
    }

    private static String enc(String v) {
        return URLEncoder.encode(v, StandardCharsets.UTF_8);
    }

    /** Exchange authorization code for refresh + access tokens. */
    public Map<String, String> exchangeCode(String code) {
        AppProperties.Gmail cfg = appProperties.getGmail();
        String body = "code=" + enc(code)
            + "&client_id=" + enc(cfg.getClientId())
            + "&client_secret=" + enc(cfg.getClientSecret())
            + "&redirect_uri=" + enc(cfg.getRedirectUri())
            + "&grant_type=authorization_code";
        @SuppressWarnings("unchecked")
        Map<String, Object> resp = webClient.post()
            .uri(TOKEN_URL)
            .header("Content-Type", "application/x-www-form-urlencoded")
            .bodyValue(body)
            .retrieve()
            .bodyToMono(Map.class)
            .block();
        if (resp == null || !resp.containsKey("refresh_token")) {
            throw new RuntimeException("Google token exchange failed — no refresh_token in response");
        }
        return Map.of(
            "access_token",  (String) resp.get("access_token"),
            "refresh_token", (String) resp.get("refresh_token")
        );
    }

    /**
     * Refresh the access token. Returns null if the refresh token has been revoked
     * (Google returns 400 "invalid_grant"). Callers that receive null must disconnect
     * the user's Gmail connection.
     */
    public String refreshAccessToken(String refreshToken) {
        AppProperties.Gmail cfg = appProperties.getGmail();
        String body = "refresh_token=" + enc(refreshToken)
            + "&client_id=" + enc(cfg.getClientId())
            + "&client_secret=" + enc(cfg.getClientSecret())
            + "&grant_type=refresh_token";
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> resp = webClient.post()
                .uri(TOKEN_URL)
                .header("Content-Type", "application/x-www-form-urlencoded")
                .bodyValue(body)
                .retrieve()
                .bodyToMono(Map.class)
                .block();
            if (resp == null || !resp.containsKey("access_token")) {
                throw new RuntimeException("Token refresh returned no access_token");
            }
            return (String) resp.get("access_token");
        } catch (WebClientResponseException e) {
            if (e.getStatusCode().value() == 400 || e.getStatusCode().value() == 401) {
                log.warn("Gmail refresh token revoked — returning null to trigger disconnect");
                return null;
            }
            throw e;
        }
    }

    /** Fetch the Google account email for the given access token. */
    public String fetchGmailEmail(String accessToken) {
        @SuppressWarnings("unchecked")
        Map<String, Object> info = webClient.get()
            .uri(USERINFO_URL)
            .header("Authorization", "Bearer " + accessToken)
            .retrieve()
            .bodyToMono(Map.class)
            .block();
        return info != null ? (String) info.get("email") : null;
    }

    /**
     * List unread Gmail message IDs from the given sender that have attachments.
     * Returns up to 20 per call (sufficient for daily sync).
     */
    public List<String> listMessageIds(String accessToken, String senderEmail) {
        String query = "from:" + senderEmail + " has:attachment is:unread newer_than:90d";
        String uri = UriComponentsBuilder.fromHttpUrl(GMAIL_BASE + "/messages")
            .queryParam("q", query)
            .queryParam("maxResults", 20)
            .build().toUriString();
        @SuppressWarnings("unchecked")
        Map<String, Object> resp = webClient.get()
            .uri(uri)
            .header("Authorization", "Bearer " + accessToken)
            .retrieve()
            .bodyToMono(Map.class)
            .block();
        if (resp == null || !resp.containsKey("messages")) return List.of();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> msgs = (List<Map<String, Object>>) resp.get("messages");
        return msgs.stream().map(m -> (String) m.get("id")).toList();
    }

    /** Attachment metadata: returns list of {attachmentId, filename, mimeType} maps. */
    public List<Map<String, String>> listAttachments(String accessToken, String messageId) {
        String uri = UriComponentsBuilder.fromHttpUrl(GMAIL_BASE + "/messages/{id}")
            .queryParam("format", "full")
            .buildAndExpand(messageId).toUriString();
        @SuppressWarnings("unchecked")
        Map<String, Object> msg = webClient.get()
            .uri(uri)
            .header("Authorization", "Bearer " + accessToken)
            .retrieve()
            .bodyToMono(Map.class)
            .block();
        if (msg == null) return List.of();
        List<Map<String, String>> result = new ArrayList<>();
        collectAttachments(msg, result);
        return result;
    }

    @SuppressWarnings("unchecked")
    private void collectAttachments(Map<String, Object> part, List<Map<String, String>> out) {
        Map<String, Object> body = (Map<String, Object>) part.get("body");
        if (body != null && body.containsKey("attachmentId")) {
            String mime = (String) part.get("mimeType");
            if (mime != null && (mime.equals("application/pdf")
                    || mime.startsWith("image/jpeg")
                    || mime.startsWith("image/png"))) {
                out.add(Map.of(
                    "attachmentId", (String) body.get("attachmentId"),
                    "filename",     String.valueOf(part.getOrDefault("filename", "attachment")),
                    "mimeType",     mime
                ));
            }
        }
        List<Map<String, Object>> parts = (List<Map<String, Object>>) part.get("parts");
        if (parts != null) parts.forEach(p -> collectAttachments(p, out));
    }

    /** Download attachment bytes (base64url-encoded in Gmail API → raw bytes). */
    public byte[] downloadAttachment(String accessToken, String messageId, String attachmentId) {
        String uri = UriComponentsBuilder
            .fromHttpUrl(GMAIL_BASE + "/messages/{msgId}/attachments/{attId}")
            .buildAndExpand(messageId, attachmentId).toUriString();
        @SuppressWarnings("unchecked")
        Map<String, Object> resp = webClient.get()
            .uri(uri)
            .header("Authorization", "Bearer " + accessToken)
            .retrieve()
            .bodyToMono(Map.class)
            .block();
        if (resp == null || !resp.containsKey("data")) throw new RuntimeException("Empty attachment response");
        return Base64.getUrlDecoder().decode((String) resp.get("data"));
    }

    /** Purge expired state nonces — called by the daily poller. */
    @Transactional
    public void cleanExpiredStates() {
        stateRepo.deleteByExpiresAtBefore(OffsetDateTime.now());
    }
}
