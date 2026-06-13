<?php

namespace App\Http\Controllers\Api\Student;

use App\Http\Controllers\Controller;
use App\Models\ClassAnnouncement;
use App\Models\ClassAnnouncementRead;
use App\Models\StudentProfile;
use App\Services\AuditLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class AnnouncementController extends Controller
{
    public function index(Request $request)
    {
        $studentId = $request->user()->id;
        $profile = StudentProfile::query()->where('user_id', $studentId)->firstOrFail();

        $announcements = ClassAnnouncement::query()
            ->with(['creator'])
            ->where('class_id', $profile->class_id)
            ->whereNotNull('published_at')
            ->orderByDesc('published_at')
            ->paginate(20);

        $readIds = ClassAnnouncementRead::query()
            ->where('student_id', $studentId)
            ->whereIn('announcement_id', collect($announcements->items())->pluck('id'))
            ->pluck('announcement_id')
            ->all();

        return response()->json([
            'data' => $announcements,
            'read_ids' => $readIds,
        ]);
    }

    public function markRead(Request $request, ClassAnnouncement $announcement)
    {
        $studentId = $request->user()->id;
        $profile = StudentProfile::query()->where('user_id', $studentId)->firstOrFail();

        if ((int) $announcement->class_id !== (int) $profile->class_id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        if (! $announcement->isPublished()) {
            return response()->json(['message' => 'Announcement not published.'], 422);
        }

        ClassAnnouncementRead::query()->updateOrCreate(
            ['announcement_id' => $announcement->id, 'student_id' => $studentId],
            ['read_at' => Carbon::now()]
        );

        AuditLogger::log($request->user(), 'announcement.read', $announcement, 'Marked announcement as read');

        return response()->json(['ok' => true]);
    }
}

