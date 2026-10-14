package sample;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class AdminUserController {

    private final Accounts accounts;

    public AdminUserController(Accounts accounts) {
        this.accounts = accounts;
    }

    @GetMapping("/admin/users")
    public String users(Model model) {
        model.addAttribute("accounts", accounts.all());
        return "admin/users";
    }
}
