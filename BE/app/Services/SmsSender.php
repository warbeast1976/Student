<?php

namespace App\Services;

interface SmsSender
{
    public function send(string $to, string $message): void;
}

