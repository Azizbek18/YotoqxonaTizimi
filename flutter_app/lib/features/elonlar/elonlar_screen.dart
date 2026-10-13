import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_exception.dart';
import '../../core/theme/app_colors.dart';
import '../../shared/widgets/app_bottom_nav.dart';
import 'elonlar_api.dart';
import 'elonlar_models.dart';

Color _typeColor(String type) {
  switch (type) {
    case 'Muhim':
      return AppColors.rose;
    case 'Tadbir':
      return AppColors.emerald;
    case 'Ogohlantirish':
      return AppColors.amber;
    case 'Yangilik':
    default:
      return AppColors.blue;
  }
}

IconData _typeIcon(String type) {
  switch (type) {
    case 'Muhim':
      return Icons.notifications_active_rounded;
    case 'Tadbir':
      return Icons.event_rounded;
    case 'Ogohlantirish':
      return Icons.warning_amber_rounded;
    case 'Yangilik':
    default:
      return Icons.campaign_rounded;
  }
}

class ElonlarScreen extends ConsumerStatefulWidget {
  const ElonlarScreen({super.key});

  @override
  ConsumerState<ElonlarScreen> createState() => _ElonlarScreenState();
}

class _ElonlarScreenState extends ConsumerState<ElonlarScreen> {
  List<Announcement> _elonlar = [];
  String? _currentFaculty;
  bool _faculty = false;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (!mounted) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final page = await ref.read(elonlarApiProvider).fetchAnnouncements();
      if (!mounted) return;
      setState(() {
        _elonlar = page.elonlar;
        _currentFaculty = page.currentFaculty;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error is ApiException
            ? error.message
            : "E'lonlarni yuklab bo'lmadi";
        _loading = false;
      });
    }
  }

  List<Announcement> get _visible {
    if (!_faculty) return _elonlar.where((e) => e.isDormWide).toList();
    return _elonlar
        .where(
          (e) =>
              e.isFacultyScoped &&
              _currentFaculty != null &&
              e.faculty == _currentFaculty,
        )
        .toList();
  }

  void _openDetail(Announcement elon) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _AnnouncementDetailSheet(elon: elon),
    );
  }

  @override
  Widget build(BuildContext context) {
    final visible = _visible;
    return Scaffold(
      appBar: AppBar(
        title: const Text("E'lonlar"),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(52),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
            child: SegmentedButton<bool>(
              segments: [
                const ButtonSegment(
                  value: false,
                  label: Text('Yotoqxona'),
                  icon: Icon(Icons.apartment_rounded),
                ),
                ButtonSegment(
                  value: true,
                  label: Text(_currentFaculty ?? 'Fakultetim'),
                  icon: const Icon(Icons.school_rounded),
                ),
              ],
              selected: {_faculty},
              onSelectionChanged: (value) =>
                  setState(() => _faculty = value.first),
            ),
          ),
        ),
      ),
      bottomNavigationBar: const AppBottomNav(currentPath: '/elonlar'),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
          ? Center(child: Text(_error!))
          : RefreshIndicator(
              onRefresh: _load,
              child: visible.isEmpty
                  ? ListView(
                      children: [
                        Padding(
                          padding: const EdgeInsets.all(48),
                          child: Column(
                            children: [
                              Icon(
                                Icons.campaign_outlined,
                                size: 40,
                                color: Theme.of(context).disabledColor,
                              ),
                              const SizedBox(height: 12),
                              Text(
                                _faculty
                                    ? "Fakultetingiz uchun e'lon yo'q"
                                    : "Hozircha e'lon yo'q",
                                textAlign: TextAlign.center,
                                style: Theme.of(context).textTheme.bodyMedium,
                              ),
                            ],
                          ),
                        ),
                      ],
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.fromLTRB(16, 4, 16, 96),
                      itemCount: visible.length,
                      itemBuilder: (context, index) {
                        final elon = visible[index];
                        final color = _typeColor(elon.type);
                        return Card(
                          margin: const EdgeInsets.only(bottom: 12),
                          child: InkWell(
                            borderRadius: BorderRadius.circular(18),
                            onTap: () => _openDetail(elon),
                            child: Padding(
                              padding: const EdgeInsets.all(14),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Container(
                                    width: 38,
                                    height: 38,
                                    decoration: BoxDecoration(
                                      color: color.withValues(alpha: 0.14),
                                      borderRadius: BorderRadius.circular(11),
                                    ),
                                    child: Icon(
                                      _typeIcon(elon.type),
                                      color: color,
                                      size: 19,
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          children: [
                                            Expanded(
                                              child: Text(
                                                elon.title,
                                                style: Theme.of(context)
                                                    .textTheme
                                                    .titleMedium,
                                              ),
                                            ),
                                            Text(
                                              elon.relativeDate,
                                              style: Theme.of(context)
                                                  .textTheme
                                                  .labelSmall,
                                            ),
                                          ],
                                        ),
                                        const SizedBox(height: 4),
                                        Text(
                                          elon.text,
                                          maxLines: 2,
                                          overflow: TextOverflow.ellipsis,
                                          style: Theme.of(context)
                                              .textTheme
                                              .bodyMedium,
                                        ),
                                        const SizedBox(height: 6),
                                        Text(
                                          elon.sourceLabel,
                                          style: Theme.of(context)
                                              .textTheme
                                              .labelSmall
                                              ?.copyWith(color: color),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        );
                      },
                    ),
            ),
    );
  }
}

class _AnnouncementDetailSheet extends StatelessWidget {
  const _AnnouncementDetailSheet({required this.elon});
  final Announcement elon;

  @override
  Widget build(BuildContext context) {
    final color = _typeColor(elon.type);
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.14),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    elon.type,
                    style: TextStyle(
                      color: color,
                      fontWeight: FontWeight.w800,
                      fontSize: 11,
                    ),
                  ),
                ),
                const Spacer(),
                Text(
                  elon.relativeDate,
                  style: Theme.of(context).textTheme.labelSmall,
                ),
              ],
            ),
            const SizedBox(height: 14),
            Text(elon.title, style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 10),
            Text(
              elon.text,
              style: Theme.of(context).textTheme.bodyMedium
                  ?.copyWith(fontSize: 14),
            ),
            const SizedBox(height: 18),
            Row(
              children: [
                Icon(
                  Icons.person_outline_rounded,
                  size: 16,
                  color: Theme.of(context).disabledColor,
                ),
                const SizedBox(width: 6),
                Text(
                  elon.sourceLabel,
                  style: Theme.of(context).textTheme.labelSmall,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
