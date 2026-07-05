package com.expensetracker.controller;

import com.expensetracker.config.AppProperties;
import com.expensetracker.dto.request.LoginRequest;
import com.expensetracker.dto.request.RegisterRequest;
import com.expensetracker.dto.response.TokenResponse;
import com.expensetracker.dto.response.UserOut;
import com.expensetracker.security.JwtAuthFilter;
import com.expensetracker.service.AuthService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final AppProperties appProperties;

    @PostMapping("/register")
    public ResponseEntity<TokenResponse> register(@Valid @RequestBody RegisterRequest req,
                                                   HttpServletResponse httpResponse) {
        TokenResponse result = authService.register(req);
        setAuthCookie(httpResponse, result.getToken());
        return ResponseEntity.ok(result);
    }

    @PostMapping("/login")
    public ResponseEntity<TokenResponse> login(@Valid @RequestBody LoginRequest req,
                                               HttpServletRequest httpRequest,
                                               HttpServletResponse httpResponse) {
        // Tomcat's RemoteIpValve (configured in application.yml with trusted-proxies) already
        // resolves this to the real client IP from X-Forwarded-For. Reading the raw header
        // here instead would let a client set its own rate-limit bucket via a spoofed XFF.
        String ip = httpRequest.getRemoteAddr();
        TokenResponse result = authService.login(req, ip);
        setAuthCookie(httpResponse, result.getToken());
        return ResponseEntity.ok(result);
    }

    @PostMapping("/logout")
    public ResponseEntity<Map<String, String>> logout(HttpServletResponse httpResponse) {
        Cookie cookie = new Cookie(JwtAuthFilter.COOKIE_NAME, "");
        cookie.setHttpOnly(true);
        cookie.setSecure(true);
        cookie.setPath("/");
        cookie.setMaxAge(0);
        httpResponse.addCookie(cookie);
        return ResponseEntity.ok(Map.of("message", "Logged out"));
    }

    @GetMapping("/me")
    public ResponseEntity<UserOut> me(@AuthenticationPrincipal Long userId) {
        return ResponseEntity.ok(authService.getMe(userId));
    }

    @PatchMapping("/profile")
    public ResponseEntity<UserOut> updateProfile(
            @AuthenticationPrincipal Long userId,
            @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(authService.updateProfile(userId,
            body.get("email"), body.get("currentPassword"), body.get("newPassword")));
    }

    @DeleteMapping("/profile")
    public ResponseEntity<Void> deleteAccount(
            @AuthenticationPrincipal Long userId,
            @RequestBody Map<String, String> body,
            HttpServletResponse httpResponse) {
        if (!"DELETE".equals(body.get("confirmation"))) {
            throw new com.expensetracker.exception.BusinessException(
                "Invalid confirmation", org.springframework.http.HttpStatus.BAD_REQUEST);
        }
        authService.deleteAccount(userId);
        Cookie cookie = new Cookie(JwtAuthFilter.COOKIE_NAME, "");
        cookie.setHttpOnly(true);
        cookie.setSecure(true);
        cookie.setPath("/");
        cookie.setMaxAge(0);
        httpResponse.addCookie(cookie);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<Map<String, String>> forgotPassword(@RequestBody Map<String, String> body) {
        authService.forgotPassword(body.get("email"));
        return ResponseEntity.ok(Map.of("message", "If that email exists, a reset link has been sent."));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<Map<String, String>> resetPassword(@RequestBody Map<String, String> body) {
        authService.resetPassword(body.get("token"), body.get("newPassword"));
        return ResponseEntity.ok(Map.of("message", "Password updated."));
    }

    private void setAuthCookie(HttpServletResponse response, String token) {
        Cookie cookie = new Cookie(JwtAuthFilter.COOKIE_NAME, token);
        cookie.setHttpOnly(true);
        cookie.setSecure(true);
        cookie.setPath("/");
        cookie.setAttribute("SameSite", "Strict");
        cookie.setMaxAge(appProperties.getJwt().getExpiryDays() * 24 * 60 * 60);
        response.addCookie(cookie);
    }
}
