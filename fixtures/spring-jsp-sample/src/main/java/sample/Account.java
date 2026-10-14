package sample;

public class Account {

    private final String username;
    private final String password;
    private final String name;
    private final String role;

    public Account(String username, String password, String name, String role) {
        this.username = username;
        this.password = password;
        this.name = name;
        this.role = role;
    }

    public String getUsername() {
        return username;
    }

    public String getName() {
        return name;
    }

    public String getRole() {
        return role;
    }

    public boolean isAdmin() {
        return "ADMIN".equals(role);
    }

    boolean matches(String username, String password) {
        return this.username.equals(username) && this.password.equals(password);
    }
}
