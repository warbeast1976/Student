<?php

namespace App\Http\Controllers\Api\Teacher;

use App\Http\Controllers\Controller;
use App\Models\ClassAnnouncement;
use App\Models\SchoolClass;
use App\Models\User;
use App\Notifications\AnnouncementPublished;
use App\Services\AuditLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class AnnouncementController extends Controller
{
    public function index(Request $request)
    {
        $teacherId = $request->user()->id;

        $query = ClassAnnouncement::query()
            ->with(['schoolClass', 'creator'])
            ->whereHas('schoolClass', fn ($q) => $q->where('teacher_id', $teacherId))
            ->orderByDesc('id');

        if ($request->filled('class_id')) {
            $query->where('class_id', $request->integer('class_id'));
        }

        return response()->json([
            'data' => $query->paginate(20),
        ]);
    }

    public function store(Request $request)
    {
        $teacherId = $request->user()->id;

        $data = $request->validate([
            'class_id' => ['required', 'integer', 'exists:classes,id'],
            'title' => ['required', 'string', 'max:255'],
            'body' => ['required', 'string'],
        ]);

        $class = SchoolClass::query()->whereKey($data['class_id'])->firstOrFail();
        abort_unless((int) $class->teacher_id === (int) $teacherId, 403);

        $announcement = ClassAnnouncement::create([
            'class_id' => $class->id,
            'created_by' => $teacherId,
            'title' => $data['title'],
            'body' => $data['body'],
            'published_at' => null,
        ]);

        AuditLogger::log($request->user(), 'announcement.create', $announcement, 'Created class announcement');

        return response()->json(['data' => $announcement], 201);
    }

    public function publish(Request $request, ClassAnnouncement $announcement)
    {
        $teacherId = $request->user()->id;
        $class = SchoolClass::query()->whereKey($announcement->class_id)->firstOrFail();
        abort_unless((int) $class->teacher_id === (int) $teacherId, 403);

        $announcement->published_at = Carbon::now();
        $announcement->save();

        AuditLogger::log($request->user(), 'announcement.publish', $announcement, 'Published class announcement');

        // Notify students in this class (email via log, SMS via log by default)
        User::query()
            ->with('studentProfile')
            ->whereHas('studentProfile', fn ($q) => $q->where('class_id', $class->id))
            ->chunk(200, function ($students) use ($announcement) {
                foreach ($students as $s) {
                    $s->notify(new AnnouncementPublished($announcement));
                }
            });

        return response()->json(['data' => $announcement]);
    }

    public function destroy(Request $request, ClassAnnouncement $announcement)
    {
        $teacherId = $request->user()->id;
        $class = SchoolClass::query()->whereKey($announcement->class_id)->firstOrFail();
        abort_unless((int) $class->teacher_id === (int) $teacherId, 403);

        $announcement->delete();
        AuditLogger::log($request->user(), 'announcement.delete', null, "Deleted announcement {$announcement->id}");

        return response()->json(['ok' => true]);
    }
}

