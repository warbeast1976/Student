<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('class_subject_teachers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('class_id')->constrained('classes')->cascadeOnDelete();
            $table->foreignId('subject_id')->constrained('subjects')->cascadeOnDelete();
            $table->foreignId('teacher_id')->constrained('users')->cascadeOnUpdate()->restrictOnDelete();
            $table->timestamps();

            $table->unique(['class_id', 'subject_id']);
            $table->index(['teacher_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('class_subject_teachers');
    }
};
