FROM php:8.3-fpm-alpine

RUN docker-php-ext-install mysqli pdo_mysql

WORKDIR /var/www/html

COPY public/frontend /var/www/html/frontend
COPY public/backend /var/www/html/backend
