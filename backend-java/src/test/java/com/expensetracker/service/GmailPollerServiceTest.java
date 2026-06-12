package com.expensetracker.service;

import com.expensetracker.repository.GmailFilterSenderRepository;
import com.expensetracker.repository.GmailProcessedMessageRepository;
import com.expensetracker.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class GmailPollerServiceTest {

    private GmailPollerService poller;

    @BeforeEach
    void setUp() {
        poller = new GmailPollerService(
            mock(UserRepository.class),
            mock(GmailFilterSenderRepository.class),
            mock(GmailProcessedMessageRepository.class),
            mock(GmailService.class),
            mock(StatementService.class)
        );
    }

    @Test
    void parseSyncDays_parsesCommaSeparated() throws Exception {
        Method m = GmailPollerService.class.getDeclaredMethod("parseSyncDays", String.class);
        m.setAccessible(true);
        @SuppressWarnings("unchecked")
        Set<Integer> result = (Set<Integer>) m.invoke(poller, "1,2,3,28,29,30,31");
        assertThat(result).containsExactlyInAnyOrder(1, 2, 3, 28, 29, 30, 31);
    }

    @Test
    void parseSyncDays_handlesBlank() throws Exception {
        Method m = GmailPollerService.class.getDeclaredMethod("parseSyncDays", String.class);
        m.setAccessible(true);
        @SuppressWarnings("unchecked")
        Set<Integer> result = (Set<Integer>) m.invoke(poller, "");
        assertThat(result).isEmpty();
    }
}
