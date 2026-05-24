package com.expensetracker.model;

import com.expensetracker.config.EncryptedStringConverter;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;

@Entity
@Table(name = "users")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @EqualsAndHashCode.Include
    private Long id;

    @Column(nullable = false, unique = true)
    private String username;

    @Column(unique = true)
    private String email;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Convert(converter = EncryptedStringConverter.class)
    @Column(name = "groq_api_key")
    private String groqApiKey;

    @Convert(converter = EncryptedStringConverter.class)
    @Column(name = "openrouter_api_key")
    private String openrouterApiKey;

    @Convert(converter = EncryptedStringConverter.class)
    @Column(name = "anthropic_api_key")
    private String anthropicApiKey;

    @Column(name = "ai_provider", nullable = false)
    @Builder.Default
    private String aiProvider = "auto";

    @Column(name = "concurrent_processing", nullable = false)
    @Builder.Default
    private int concurrentProcessing = 2;

}
