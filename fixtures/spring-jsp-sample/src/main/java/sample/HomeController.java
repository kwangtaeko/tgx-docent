package sample;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

@Controller
public class HomeController {

    private final ProductStore products;

    public HomeController(ProductStore products) {
        this.products = products;
    }

    @GetMapping("/")
    public String home(@RequestParam(required = false) String denied, Model model) {
        model.addAttribute("productCount", products.all().size());
        model.addAttribute("lowStock", products.lowStock(5));
        if (denied != null) {
            model.addAttribute("error", "관리자만 사용할 수 있는 화면입니다.");
        }
        return "home";
    }
}
