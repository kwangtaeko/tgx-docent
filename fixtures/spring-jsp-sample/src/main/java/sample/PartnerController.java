package sample;

import java.util.List;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

// 상품 등록·수정 화면에서 새 창으로 여는 거래처 검색 팝업
@Controller
public class PartnerController {

    private static final List<String> PARTNERS = List.of("가나상사", "다라문구", "마바유통");

    @GetMapping("/popup/partners")
    public String search(@RequestParam(required = false) String keyword, Model model) {
        List<String> found = keyword == null || keyword.isBlank()
            ? PARTNERS
            : PARTNERS.stream().filter(p -> p.contains(keyword)).toList();
        model.addAttribute("keyword", keyword);
        model.addAttribute("partners", found);
        return "popup/partners";
    }
}
