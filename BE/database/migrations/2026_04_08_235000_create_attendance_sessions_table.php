<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('attendance_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('class_id')->constrained('classes')->cascadeOnUpdate()->restrictOnDelete();
            $table->foreignId('teacher_id')->constrained('users')->cascadeOnUpdate()->restrictOnDelete();
            $table->foreignId('school_year_id')->constrained('school_years')->cascadeOnUpdate()->restrictOnDelete();
            $table->date('attendance_date');

            // We store only a hash so a leaked DB doesn't expose scannable tokens.
            $table->string('token_hash', 64)->unique();

            $table->timestamp('starts_at');
            $table->timestamp('ends_at');
            $table->enum('status', ['open', 'closed'])->default('open');

            $table->timestamps();

            $table->index(['class_id', 'attendance_date']);
            $table->index(['teacher_id', 'attendance_date']);
            $table->index(['status', 'starts_at', 'ends_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attendance_sessions');
    }
};

