package com.expensetracker.service;

import com.expensetracker.dto.request.SaveReportRequest;
import com.expensetracker.exception.EntityNotFoundException;
import com.expensetracker.model.SavedReport;
import com.expensetracker.repository.SavedReportRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class ReportService {

    private final SavedReportRepository savedReportRepository;
    private final AnalyticsService analyticsService;
    private final TransactionService transactionService;

    public Map<String, Object> generate(Long userId, LocalDate from, LocalDate to) {
        LocalDate f = from != null ? from : LocalDate.now().withDayOfMonth(1);
        LocalDate t = to != null ? to : LocalDate.now();

        Map<String, Object> report = new LinkedHashMap<>();
        report.put("from_date", f);
        report.put("to_date", t);
        report.put("summary", analyticsService.summary(userId, f, t));
        report.put("category_breakdown", analyticsService.categoryBreakdown(userId, f, t));
        report.put("frequent_merchants", analyticsService.frequentPlaces(userId, f, t));
        report.put("monthly_overview", analyticsService.monthComparison(userId, 3));
        return report;
    }

    public List<SavedReport> listSaved(Long userId) {
        return savedReportRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    @Transactional
    public SavedReport save(Long userId, SaveReportRequest req) {
        SavedReport report = SavedReport.builder()
                .userId(userId).name(req.getName())
                .fromDate(req.getFromDate()).toDate(req.getToDate())
                .build();
        return savedReportRepository.save(report);
    }

    @Transactional
    public void deleteSaved(Long id, Long userId) {
        SavedReport report = savedReportRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new EntityNotFoundException("Report not found"));
        savedReportRepository.delete(report);
    }
}
