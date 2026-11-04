import 'package:flutter_test/flutter_test.dart';
import 'package:laxmi_enterprises_mobile/main.dart';

void main() {
  testWidgets('App initializes smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const LaxmiEnterprisesApp());
    expect(find.byType(LaxmiEnterprisesApp), findsOneWidget);
  });
}
