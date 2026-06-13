<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('absence_attachments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('absence_report_id')->constrained('absence_reports')->cascadeOnUpdate()->cascadeOnDelete();
            $table->string('file_name');
            $table->string('file_path');
            $table->string('file_type', 100)->nullable();
            $table->unsignedBigInteger('file_size')->nullable();
            $table->timestamps();

            $table->index(['absence_report_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('absence_attachments');
    }
};
