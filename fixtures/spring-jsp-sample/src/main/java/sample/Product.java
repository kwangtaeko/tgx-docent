package sample;

public class Product {

    private final long id;
    private final String name;
    private final String partner;
    private final int price;
    private final int stock;

    public Product(long id, String name, String partner, int price, int stock) {
        this.id = id;
        this.name = name;
        this.partner = partner;
        this.price = price;
        this.stock = stock;
    }

    public long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getPartner() {
        return partner;
    }

    public int getPrice() {
        return price;
    }

    public int getStock() {
        return stock;
    }
}
