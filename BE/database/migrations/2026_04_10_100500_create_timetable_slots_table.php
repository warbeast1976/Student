<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('timetable_slots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('class_id')->constrained('classes')->cascadeOnDelete();
            $table->unsignedTinyInteger('day_of_week');
            $table->time('start_time');
            $table->time('end_time');
            $table->foreignId('subject_id')->constrained('subjects')->cascadeOnDelete();
            $table->foreignId('teacher_id')->constrained('users')->cascadeOnUpdate()->restrictOnDelete();
            $table->string('room', 64)->nullable();
            $table->timestamps();

            $table->index(['class_id', 'day_of_week']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('timetable_slots');
    }
};
