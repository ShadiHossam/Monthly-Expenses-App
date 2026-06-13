package com.expensetracker.repository;

import com.expensetracker.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByUsername(String username);
    Optional<User> findByEmail(String email);
    boolean existsByUsername(String username);
    boolean existsByEmail(String email);
    List<User> findAllByGmailRefreshTokenNotNull();

    long countByCreatedAtAfter(OffsetDateTime date);

    @Query(value = """
        SELECT to_char(created_at::date, 'YYYY-MM-DD') AS day, COUNT(*) AS cnt
        FROM users
        WHERE created_at >= :since
        GROUP BY 1
        ORDER BY 1
        """, nativeQuery = true)
    List<Object[]> signupsPerDaySince(@Param("since") OffsetDateTime since);
}
