package com.miotranslate.shared.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.List;
import java.util.UUID;

@Service
public class JwtService {

    @Value("${miotranslate.jwt.secret:miotranslate-super-secure-jwt-signing-key-minimum-256-bits-long}")
    private String jwtSecret;

    // 8 hours in milliseconds
    private static final long JWT_EXPIRATION_MS = 8 * 60 * 60 * 1000;

    private SecretKey getSigningKey() {
        return Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
    }

    public String generateToken(UUID userId, String email, String displayName, 
                                List<String> roles, List<String> permissions, 
                                boolean mustChangePassword) {
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + JWT_EXPIRATION_MS);

        return Jwts.builder()
                .subject(userId.toString())
                .claim("email", email)
                .claim("displayName", displayName)
                .claim("roles", roles)
                .claim("permissions", permissions)
                .claim("mustChangePassword", mustChangePassword)
                .issuedAt(now)
                .expiration(expiryDate)
                .signWith(getSigningKey())
                .compact();
    }

    public Claims validateTokenAndGetClaims(String token) {
        return Jwts.parser()
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
