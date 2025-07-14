import { Todo } from "@/types";
import TodoItem from "./TodoItem";

interface TodolistProps {
    todos: Todo[]; // 定义todos的类型为Todo数组
    delleteTodo: (id: number) => void; // 定义delleteTodo函数的类型
    toggleTodo: (id: number) => void; // 定义toggleTodo函数的类型
}

function TodoList({ todos, delleteTodo, toggleTodo }: TodolistProps) {
    return (
        <ul>
            {todos.map(todo => (
                <TodoItem
                    key={todo.id}
                    todo={todo}  // 确保 todo 不为空
                    delleteTodo={delleteTodo}
                    toggleTodo={toggleTodo}
                />
            ))}
        </ul>
    );
}

export default TodoList;