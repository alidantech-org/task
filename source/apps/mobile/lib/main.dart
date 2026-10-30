import 'package:flutter/material.dart';

void main() {
  runApp(const TaskMobileApp());
}

class TaskMobileApp extends StatelessWidget {
  const TaskMobileApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Task',
      theme: ThemeData(colorSchemeSeed: const Color(0xFF334155), useMaterial3: true),
      home: const Scaffold(body: Center(child: Text('Task Mobile — cloud client foundation'))),
    );
  }
}