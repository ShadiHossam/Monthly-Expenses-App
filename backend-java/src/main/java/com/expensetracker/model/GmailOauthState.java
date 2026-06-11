package com.expensetracker.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.OffsetDateTime;

@Entity
@Table(name = "gmail_oauth_states")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GmailOauthState {

    @Id
    @Column(name = "state", length = 36)
    private String state;  // UUID primary key

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "expires_at", nullable = false)
    private OffsetDateTime expiresAt;
}
