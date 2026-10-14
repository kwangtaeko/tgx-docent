package sample;

import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Component;

// 데모 계정(픽스처용). 실제 서비스라면 DB와 암호화된 비밀번호를 쓴다.
@Component
public class Accounts {

    private final List<Account> accounts = List.of(
        new Account("user", "user1234", "김영업", "SALES"),
        new Account("admin", "admin1234", "이관리", "ADMIN"));

    public Optional<Account> find(String username, String password) {
        return accounts.stream()
            .filter(a -> a.matches(username, password))
            .findFirst();
    }

    public List<Account> all() {
        return accounts;
    }
}
