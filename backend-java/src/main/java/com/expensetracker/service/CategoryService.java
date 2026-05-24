package com.expensetracker.service;

import com.expensetracker.dto.request.CategoryRequest;
import com.expensetracker.dto.response.CategoryOut;
import com.expensetracker.exception.BusinessException;
import com.expensetracker.exception.EntityNotFoundException;
import com.expensetracker.model.Category;
import com.expensetracker.repository.CategoryRepository;
import com.expensetracker.repository.MerchantRuleRepository;
import com.expensetracker.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class CategoryService {

    private final CategoryRepository categoryRepository;
    private final TransactionRepository transactionRepository;

    public List<CategoryOut> list(Long userId) {
        return categoryRepository.findByUserIdOrderByName(userId)
                .stream()
                .map(c -> toOut(c, categoryRepository.countTransactions(userId, c.getId())))
                .toList();
    }

    @Transactional
    public CategoryOut create(Long userId, CategoryRequest req) {
        Category cat = Category.builder()
                .userId(userId)
                .name(req.getName())
                .color(req.getColor() != null ? req.getColor() : "#6b7280")
                .icon(req.getIcon() != null ? req.getIcon() : "tag")
                .build();
        cat = categoryRepository.save(cat);
        return toOut(cat, 0L);
    }

    @Transactional
    public CategoryOut update(Long id, Long userId, CategoryRequest req) {
        Category cat = categoryRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new EntityNotFoundException("Category not found"));
        if (cat.isSystem() && req.getName() != null && !req.getName().equals(cat.getName())) {
            throw new BusinessException("Cannot rename system categories", HttpStatus.BAD_REQUEST);
        }
        if (req.getName() != null) cat.setName(req.getName());
        if (req.getColor() != null) cat.setColor(req.getColor());
        if (req.getIcon() != null) cat.setIcon(req.getIcon());
        cat = categoryRepository.save(cat);
        return toOut(cat, categoryRepository.countTransactions(userId, cat.getId()));
    }

    @Transactional
    public void delete(Long id, Long userId) {
        Category cat = categoryRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new EntityNotFoundException("Category not found"));
        if (cat.isSystem()) {
            throw new BusinessException("Cannot delete system categories", HttpStatus.BAD_REQUEST);
        }

        Category uncategorized = categoryRepository.findByUserIdAndName(userId, "Uncategorized")
                .orElse(null);

        if (uncategorized != null) {
            transactionRepository.bulkCategorize(uncategorized.getId(),
                    transactionRepository.findByUserIdAndIsCategorizedFalse(userId)
                            .stream().map(t -> t.getId()).toList(), userId);
        }

        categoryRepository.delete(cat);
    }

    public CategoryOut getById(Long id, Long userId) {
        Category cat = categoryRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new EntityNotFoundException("Category not found"));
        return toOut(cat, categoryRepository.countTransactions(userId, cat.getId()));
    }

    private CategoryOut toOut(Category c, long txCount) {
        return CategoryOut.builder()
                .id(c.getId()).userId(c.getUserId()).name(c.getName())
                .color(c.getColor()).icon(c.getIcon()).isSystem(c.isSystem())
                .createdAt(c.getCreatedAt()).transactionCount(txCount)
                .build();
    }
}
