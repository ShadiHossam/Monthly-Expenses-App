package com.expensetracker.repository;

import com.expensetracker.model.Category;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CategoryRepository extends JpaRepository<Category, Long> {
    List<Category> findByUserIdOrderByName(Long userId);
    Optional<Category> findByIdAndUserId(Long id, Long userId);
    Optional<Category> findByUserIdAndName(Long userId, String name);
    boolean existsByUserIdAndName(Long userId, String name);

    @Query("SELECT COUNT(t) FROM Transaction t WHERE t.userId = :userId AND t.categoryId = :categoryId")
    long countTransactions(@Param("userId") Long userId, @Param("categoryId") Long categoryId);
}
