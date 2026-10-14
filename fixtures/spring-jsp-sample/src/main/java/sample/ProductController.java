package sample;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

@Controller
@RequestMapping("/products")
public class ProductController {

    private final ProductStore store;

    public ProductController(ProductStore store) {
        this.store = store;
    }

    @GetMapping
    public String list(@RequestParam(required = false) String keyword, Model model) {
        model.addAttribute("keyword", keyword);
        model.addAttribute("products", store.search(keyword));
        return "products/list";
    }

    @GetMapping("/new")
    public String newForm(Model model) {
        model.addAttribute("product", new Product(0, "", "", 0, 0));
        return "products/form";
    }

    @PostMapping("/new")
    public String create(@RequestParam String name, @RequestParam String partner, @RequestParam(defaultValue = "-1") int price,
                         @RequestParam(defaultValue = "0") int stock, Model model, RedirectAttributes flash) {
        Product product = new Product(0, name, partner, price, stock);
        String error = validate(product);
        if (error != null) {
            model.addAttribute("product", product);
            model.addAttribute("error", error);
            return "products/form";
        }
        store.save(product);
        flash.addFlashAttribute("message", "등록되었습니다.");
        return "redirect:/products";
    }

    @GetMapping("/{id}")
    public String detail(@PathVariable long id, Model model) {
        model.addAttribute("product", store.find(id).orElseThrow());
        return "products/detail";
    }

    @GetMapping("/{id}/edit")
    public String editForm(@PathVariable long id, Model model) {
        model.addAttribute("product", store.find(id).orElseThrow());
        return "products/form";
    }

    @PostMapping("/{id}/edit")
    public String update(@PathVariable long id, @RequestParam String name, @RequestParam String partner,
                         @RequestParam(defaultValue = "-1") int price, @RequestParam(defaultValue = "0") int stock,
                         Model model, RedirectAttributes flash) {
        Product product = new Product(id, name, partner, price, stock);
        String error = validate(product);
        if (error != null) {
            model.addAttribute("product", product);
            model.addAttribute("error", error);
            return "products/form";
        }
        store.save(product);
        flash.addFlashAttribute("message", "수정되었습니다.");
        return "redirect:/products/" + id;
    }

    @PostMapping("/{id}/delete")
    public String delete(@PathVariable long id, RedirectAttributes flash) {
        Product product = store.find(id).orElseThrow();
        if (product.getStock() > 0) {
            flash.addFlashAttribute("error", "재고가 남아 있어 삭제할 수 없습니다.");
            return "redirect:/products/" + id;
        }
        store.delete(id);
        flash.addFlashAttribute("message", "삭제되었습니다.");
        return "redirect:/products";
    }

    private String validate(Product p) {
        if (p.getName() == null || p.getName().isBlank()) {
            return "상품명을 입력하세요.";
        }
        if (p.getPartner() == null || p.getPartner().isBlank()) {
            return "거래처를 선택하세요.";
        }
        if (p.getPrice() < 0) {
            return "단가는 0 이상이어야 합니다.";
        }
        return null;
    }
}
