package com.miotranslate.shared.auth;

import com.miotranslate.modules.admin.model.User;
import com.miotranslate.modules.admin.repository.UserRepository;
import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.env.Environment;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final PermissionService permissionService;
    private final Environment environment;

    public JwtAuthFilter(JwtService jwtService, UserRepository userRepository, 
                         PermissionService permissionService, Environment environment) {
        this.jwtService = jwtService;
        this.userRepository = userRepository;
        this.permissionService = permissionService;
        this.environment = environment;
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request, @NonNull HttpServletResponse response, @NonNull FilterChain filterChain)
            throws ServletException, IOException {

        String authHeader = request.getHeader("Authorization");

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            if (Arrays.asList(environment.getActiveProfiles()).contains("mock") 
                    || !Boolean.parseBoolean(environment.getProperty("miotranslate.auth.enabled", "true"))) {
                UUID defaultUserId = UUID.fromString("a0000000-0000-0000-0000-000000000001");
                List<SimpleGrantedAuthority> authorities = List.of(
                    new SimpleGrantedAuthority("PERMISSION_*"),
                    new SimpleGrantedAuthority("ROLE_DEV"),
                    new SimpleGrantedAuthority("ROLE_ADMIN"),
                    new SimpleGrantedAuthority("ROLE_FN")
                );
                UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                        defaultUserId, null, authorities);
                SecurityContextHolder.getContext().setAuthentication(auth);
            }
            filterChain.doFilter(request, response);
            return;
        }

        String token = authHeader.substring(7);
        try {
            Claims claims = jwtService.validateTokenAndGetClaims(token);
            UUID userId = UUID.fromString(claims.getSubject());

            User user = userRepository.findById(userId).orElse(null);
            
            if (user == null || !user.getIsActive()) {
                response.sendError(HttpServletResponse.SC_FORBIDDEN, "ACCOUNT_SUSPENDED");
                return;
            }
            
            boolean mustChangePassword = user.getMustChangePassword();
            
            Set<String> permissions;
            String simulateHeader = request.getHeader("X-Simulate-Roles");
            
            if (simulateHeader != null && !simulateHeader.isEmpty()) {
                List<String> actualRoles = permissionService.getRoles(userId);
                if (actualRoles.contains("DEV")) {
                    // Persona simulation
                    List<String> simulatedRoles = Arrays.asList(simulateHeader.split(","));
                    permissions = permissionService.getPermissionsForRoles(simulatedRoles);
                } else {
                    permissions = permissionService.getEffectivePermissions(userId);
                }
            } else {
                permissions = permissionService.getEffectivePermissions(userId);
            }
            
            List<SimpleGrantedAuthority> authorities = new ArrayList<>();
            for (String p : permissions) {
                authorities.add(new SimpleGrantedAuthority("PERMISSION_" + p));
            }

            UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                    userId, null, authorities);
            
            auth.setDetails(mustChangePassword);

            SecurityContextHolder.getContext().setAuthentication(auth);

        } catch (Exception e) {
            SecurityContextHolder.clearContext();
        }

        filterChain.doFilter(request, response);
    }
}
