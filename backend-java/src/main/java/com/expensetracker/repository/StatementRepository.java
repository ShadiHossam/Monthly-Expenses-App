package com.expensetracker.repository;

import com.expensetracker.model.Statement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface StatementRepository extends JpaRepository<Statement, Long> {
    List<Statement> findByUserIdOrderByCreatedAtDesc(Long userId);
    Optional<Statement> findByIdAndUserId(Long id, Long userId);
}
