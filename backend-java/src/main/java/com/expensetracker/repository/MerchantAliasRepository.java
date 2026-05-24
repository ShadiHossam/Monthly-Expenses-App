package com.expensetracker.repository;

import com.expensetracker.model.MerchantAlias;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MerchantAliasRepository extends JpaRepository<MerchantAlias, Long> {
    List<MerchantAlias> findByUserId(Long userId);
    Optional<MerchantAlias> findByIdAndUserId(Long id, Long userId);
    Optional<MerchantAlias> findByUserIdAndRawName(Long userId, String rawName);
}
