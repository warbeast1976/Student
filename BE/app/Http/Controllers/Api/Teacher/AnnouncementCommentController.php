<?php

namespace App\Http\Controllers\Api\Teacher;

use App\Http\Controllers\Controller;
use App\Models\ClassAnnouncement;
use App\Models\ClassAnnouncementComment;
use App\Models\SchoolClass;
use App\Services\AuditLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class AnnouncementCommentController extends Controller
{
    public function index(Request $request)
    {
        $teacherId = $request->user()->id;

        $query = ClassAnnouncementComment::query()
            ->with(['announcement.schoolClass', 'student'])
            ->whereHas('announcement.schoolClass', fn ($q) => $q->where('teacher_id', $teacherId))
            ->orderByDesc('id');

        if ($request->filled('class_id')) {
            $query->whereHas('announcement', fn ($q) => $q->where('class_id', $request->integer('class_id')));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }

        return response()->json(['data' => $query->paginate(30)]);
    }

    public function hide(Request $request, ClassAnnouncementComment $comment)
    {
        $teacherId = $request->user()->id;
        $announcement = ClassAnnouncement::query()->whereKey($comment->announcement_id)->firstOrFail();
        $class = SchoolClass::query()->whereKey($announcement->class_id)->firstOrFail();
        abort_unless((int) $class->teacher_id === (int) $teacherId, 403);

        $comment->status = ClassAnnouncementComment::STATUS_HIDDEN;
        $comment->moderated_by = $teacherId;
        $comment->moderated_at = Carbon::now();
        $comment->save();

        AuditLogger::log($request->user(), 'announcement_comment.hide', $comment, 'Hid announcement comment');

        return response()->json(['data' => $comment]);
    }

    public function unhide(Request $request, ClassAnnouncementComment $comment)
    {
        $teacherId = $request->user()->id;
        $announcement = ClassAnnouncement::query()->whereKey($comment->announcement_id)->firstOrFail();
        $class = SchoolClass::query()->whereKey($announcement->class_id)->firstOrFail();
        abort_unless((int) $class->teacher_id === (int) $teacherId, 403);

        $comment->status = ClassAnnouncementComment::STATUS_VISIBLE;
        $comment->moderated_by = $teacherId;
        $comment->moderated_at = Carbon::now();
        $comment->save();

        AuditLogger::log($request->user(), 'announcement_comment.unhide', $comment, 'Unhid announcement comment');

        return response()->json(['data' => $comment]);
    }

    public function destroy(Request $request, ClassAnnouncementComment $comment)
    {
        $teacherId = $request->user()->id;
        $announcement = ClassAnnouncement::query()->whereKey($comment->announcement_id)->firstOrFail();
        $class = SchoolClass::query()->whereKey($announcement->class_id)->firstOrFail();
        abort_unless((int) $class->teacher_id === (int) $teacherId, 403);

        $id = $comment->id;
        $comment->delete();

        AuditLogger::log($request->user(), 'announcement_comment.delete', null, "Deleted announcement comment {$id} (teacher)");

        return response()->json(['ok' => true]);
    }
}

