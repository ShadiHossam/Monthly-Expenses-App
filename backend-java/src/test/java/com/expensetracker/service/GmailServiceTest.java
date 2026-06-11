package com.expensetracker.service;

import com.expensetracker.config.AppProperties;
import com.expensetracker.model.GmailOauthState;
import com.expensetracker.repository.GmailOauthStateRepository;
import com.expensetracker.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class GmailServiceTest {

    private GmailService gmailService;
    private GmailOauthStateRepository stateRepo;

    @BeforeEach
    void setUp() {
        AppProperties props = new AppProperties();
        props.getGmail().setClientId("test-client-id");
        props.getGmail().setClientSecret("test-secret");
        props.getGmail().setRedirectUri("http://localhost/callback");
        stateRepo = mock(GmailOauthStateRepository.class);
        when(stateRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
        gmailService = new GmailService(props, null, stateRepo, mock(UserRepository.class));
    }

    @Test
    void buildAuthUrl_storesStateAndContainsRequiredParams() {
        String url = gmailService.buildAuthUrl(42L);
        verify(stateRepo).save(any(GmailOauthState.class));
        assertThat(url).contains("client_id=test-client-id");
        assertThat(url).contains("access_type=offline");
        assertThat(url).contains("state=");
    }

    @Test
    void validateAndConsumeState_deletesOnSuccess() {
        GmailOauthState record = GmailOauthState.builder()
            .state("abc-123").userId(7L).expiresAt(OffsetDateTime.now().plusMinutes(5)).build();
        when(stateRepo.findByStateAndExpiresAtAfter(eq("abc-123"), any())).thenReturn(Optional.of(record));
        Long userId = gmailService.validateAndConsumeState("abc-123");
        assertThat(userId).isEqualTo(7L);
        verify(stateRepo).delete(record);
    }

    @Test
    void validateAndConsumeState_throwsForUnknownState() {
        when(stateRepo.findByStateAndExpiresAtAfter(any(), any())).thenReturn(Optional.empty());
        assertThatThrownBy(() -> gmailService.validateAndConsumeState("bad-state"))
            .isInstanceOf(RuntimeException.class)
            .hasMessageContaining("Invalid or expired");
    }
}
