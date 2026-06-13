<?php

namespace App\Services;

use Twilio\Rest\Client;

class TwilioSmsSender implements SmsSender
{
    public function __construct(
        private Client $client,
        private string $from
    ) {
    }

    public function send(string $to, string $message): void
    {
        $this->client->messages->create($to, [
            'from' => $this->from,
            'body' => $message,
        ]);
    }
}

