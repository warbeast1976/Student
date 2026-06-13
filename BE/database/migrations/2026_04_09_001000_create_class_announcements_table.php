<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('class_announcements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('class_id')->constrained('classes')->cascadeOnUpdate()->cascadeOnDelete();
            $table->foreignId('created_by')->constrained('users')->cascadeOnUpdate()->restrictOnDelete();
            $table->string('title');
            $table->text('body');
            $table->timestamp('published_at')->nullable();
            $table->timestamps();

            $table->index(['class_id', 'published_at']);
            $table->index(['created_by']);
        });

        Schema::create('class_announcement_reads', function (Blueprint $table) {
            $table->id();
            $table->foreignId('announcement_id')->constrained('class_announcements')->cascadeOnUpdate()->cascadeOnDelete();
            $table->foreignId('student_id')->constrained('users')->cascadeOnUpdate()->cascadeOnDelete();
            $table->timestamp('read_at');
            $table->timestamps();

            $table->unique(['announcement_id', 'student_id'], 'announcement_read_unique');
            $table->index(['student_id', 'read_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('class_announcement_reads');
        Schema::dropIfExists('class_announcements');
    }
};

