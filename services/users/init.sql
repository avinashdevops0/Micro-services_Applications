CREATE DATABASE IF NOT EXISTS users_db;
USE users_db;

CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insert sample users
INSERT INTO users (name, email, password, phone) VALUES
('John Doe', 'john@example.com', '$2a$10$N9qo8uLOickgx2ZMRZoMye3Y7Y6z/6M.8UqKJzY4JzY4JzY4JzY4Jz', '+1234567890'),
('Jane Smith', 'jane@example.com', '$2a$10$N9qo8uLOickgx2ZMRZoMye3Y7Y6z/6M.8UqKJzY4JzY4JzY4JzY4Jz', '+0987654321'),
('Admin User', 'admin@hotel.com', '$2a$10$N9qo8uLOickgx2ZMRZoMye3Y7Y6z/6M.8UqKJzY4JzY4JzY4JzY4Jz', '+1111111111');