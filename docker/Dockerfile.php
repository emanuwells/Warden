FROM php:8.3-fpm-alpine

RUN docker-php-ext-install mysqli pdo_mysql

WORKDIR /var/www/html

COPY VERSION /var/www/html/VERSION
COPY public/www /var/www/html/www
COPY public/backend /var/www/html/backend
