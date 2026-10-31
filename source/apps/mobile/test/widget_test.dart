import 'package:flutter_test/flutter_test.dart';
import 'package:task_mobile/main.dart';

void main() {
  testWidgets('renders the Task mobile foundation', (tester) async {
    await tester.pumpWidget(const TaskMobileApp());

    expect(find.text('Task Mobile — cloud client foundation'), findsOneWidget);
  });
}
