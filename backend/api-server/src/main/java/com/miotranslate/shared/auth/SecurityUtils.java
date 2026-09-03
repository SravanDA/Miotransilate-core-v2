package com.miotranslate.shared.auth;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.UUID;

public class SecurityUtils {
    
    private SecurityUtils() {}

    private static final UUID DEFAULT_SYSTEM_USER = UUID.fromString("11111111-1111-1111-1111-111111111111");

    public static UUID getCurrentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() != null) {
            if (auth.getPrincipal() instanceof UUID) {
                return (UUID) auth.getPrincipal();
            }
            if (auth.getPrincipal() instanceof String str) {
                try {
                    return UUID.fromString(str);
                } catch (IllegalArgumentException ignored) {}
            }
        }
        return DEFAULT_SYSTEM_USER;
    }

    public static boolean hasPermission(String permission) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) {
            return false;
        }
        return auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals(permission));
    }
}
