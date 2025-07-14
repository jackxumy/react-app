"use client"
import AddTodo from "@/components/AddTodo";
import TodoList from "@/components/TodoList";
import TodoFilter from "@/components/TodoFilter";
import React, { useState } from "react";
import { Todo } from "@/types";

export default function Home() {
  const [Todos, setTodos] = useState<Todo[]>([])// 指定Todos初始值为一个Todo类型的空数组
  const [filter, setFilter] = useState<string>("all"); // 用于存储过滤条件，初始值为"all"

  const addTodo = (text: string) => {
    const newTodo: Todo = {
      id: Date.now(), // 使用当前时间戳作为唯一ID
      text: text,
      completed: false,
    };
    setTodos([...Todos, newTodo]); // 更新Todos状态，添加新任务
  }

  const delleteTodo = (id: number) => {
    setTodos(Todos.filter(todo => todo.id !== id)); // 过滤掉被删除的任务
  }

  const toggleTodo = (id: number) => {
    setTodos(Todos.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    )); // 切换任务的完成状态
  }

  const getfilteredTodos = () => {
    if (filter === "all") {
      return Todos; // 返回所有任务
    } else if (filter === "completed") {
      return Todos.filter(todo => todo.completed); // 返回已完成的任务
    } else if (filter === "active") {
      return Todos.filter(todo => !todo.completed); // 返回未完成的任务
    }
    return Todos; // 默认返回所有任务
  }

  return (
    <div>
      <h1>
        Todolist
      </h1>
      <AddTodo addTodo={addTodo} />
      <TodoList todos={getfilteredTodos()} delleteTodo={delleteTodo} toggleTodo={toggleTodo} />
      <TodoFilter setFilter={setFilter} />
    </div>
  );
}
