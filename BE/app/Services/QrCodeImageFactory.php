<?php

namespace App\Services;

use Endroid\QrCode\Builder\Builder;
use Endroid\QrCode\Encoding\Encoding;
use Endroid\QrCode\ErrorCorrectionLevel;
use Endroid\QrCode\Writer\PngWriter;
use Endroid\QrCode\Writer\SvgWriter;
use Symfony\Component\HttpFoundation\Response;

/**
 * Shared QR image generation for attendance sessions and student ID cards.
 */
class QrCodeImageFactory
{
    public static function pngResponse(string $data, int $size = 180): Response
    {
        $size = max(128, min(1024, $size));
        $writer = new PngWriter();
        $builder = new Builder(
            writer: $writer,
            data: $data,
            encoding: new Encoding('UTF-8'),
            errorCorrectionLevel: ErrorCorrectionLevel::Medium,
            size: $size,
            margin: 8
        );

        $result = $builder->build();

        return response($result->getString(), 200, [
            'Content-Type' => 'image/png',
            'Cache-Control' => 'private, no-store',
        ]);
    }

    public static function svgOrPngResponse(string $data, string $format, int $size): Response
    {
        $size = max(128, min(1024, $size));
        $writer = $format === 'png' ? new PngWriter() : new SvgWriter();
        $builder = new Builder(
            writer: $writer,
            data: $data,
            encoding: new Encoding('UTF-8'),
            errorCorrectionLevel: ErrorCorrectionLevel::Medium,
            size: $size,
            margin: 8
        );

        $result = $builder->build();
        $contentType = $format === 'png' ? 'image/png' : 'image/svg+xml';

        return response($result->getString(), 200, [
            'Content-Type' => $contentType,
            'Cache-Control' => 'no-store',
        ]);
    }
}
