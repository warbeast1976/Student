<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('class_announcement_comments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('announcement_id')->constrained('class_announcements')->cascadeOnUpdate()->cascadeOnDelete();
            $table->foreignId('student_id')->constrained('users')->cascadeOnUpdate()->cascadeOnDelete();
            $table->text('body');
            $table->enum('status', ['visible', 'hidden'])->default('visible');
            $table->foreignId('moderated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('moderated_at')->nullable();
            $table->timestamps();

            $table->index(['announcement_id', 'status']);
            $table->index(['student_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('class_announcement_comments');
    }
};

