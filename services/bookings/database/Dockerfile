FROM mysql/mysql-server:8.0
COPY init.sql /docker-entrypoint-initdb.d/
EXPOSE 3306
env MTSQL_HOST=bookingsdb
env MYSQL_DATABASE=bookings_db
env MYSQL_ROOT_PASSWORD=rootpassword