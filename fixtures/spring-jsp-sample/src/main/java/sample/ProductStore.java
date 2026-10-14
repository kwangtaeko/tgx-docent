package sample;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentSkipListMap;
import java.util.concurrent.atomic.AtomicLong;
import org.springframework.stereotype.Component;

// 메모리 저장소(픽스처용)
@Component
public class ProductStore {

    private final Map<Long, Product> items = new ConcurrentSkipListMap<>();
    private final AtomicLong seq = new AtomicLong();

    public ProductStore() {
        save(new Product(0, "A4 복사용지", "가나상사", 25000, 40));
        save(new Product(0, "볼펜(검정)", "다라문구", 500, 3));
        save(new Product(0, "스테이플러", "가나상사", 7000, 0));
    }

    public List<Product> all() {
        return new ArrayList<>(items.values());
    }

    public List<Product> search(String keyword) {
        if (keyword == null || keyword.isBlank()) {
            return all();
        }
        return all().stream().filter(p -> p.getName().contains(keyword) || p.getPartner().contains(keyword)).toList();
    }

    public List<Product> lowStock(int under) {
        return all().stream().filter(p -> p.getStock() < under).toList();
    }

    public Optional<Product> find(long id) {
        return Optional.ofNullable(items.get(id));
    }

    public Product save(Product p) {
        long id = p.getId() == 0 ? seq.incrementAndGet() : p.getId();
        Product saved = new Product(id, p.getName(), p.getPartner(), p.getPrice(), p.getStock());
        items.put(id, saved);
        return saved;
    }

    public void delete(long id) {
        items.remove(id);
    }
}
