package sample;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

// 로그인하지 않은 사용자는 로그인 화면으로, 관리자 화면은 ADMIN만
@Component
public class AuthInterceptor implements HandlerInterceptor {

    public static final String SESSION_KEY = "account";

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        Account account = (Account) request.getSession().getAttribute(SESSION_KEY);
        if (account == null) {
            response.sendRedirect(request.getContextPath() + "/login");
            return false;
        }
        if (request.getRequestURI().startsWith(request.getContextPath() + "/admin") && !account.isAdmin()) {
            response.sendRedirect(request.getContextPath() + "/?denied");
            return false;
        }
        request.setAttribute("me", account);
        return true;
    }
}
