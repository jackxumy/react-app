import { Todo } from "@/types";

interface TodoItemProps {
  todo: Todo;
  delleteTodo: (id: number) => void;
  toggleTodo: (id: number) => void;
}

function TodoItem({ todo, delleteTodo, toggleTodo }: TodoItemProps) {

    return (
        <li style={{ textDecoration: todo.completed ? 'line-through' : 'none' }}>
            {todo.text}
            <button onClick={() => toggleTodo(todo.id)}>切换</button>
            <button onClick={() => delleteTodo(todo.id)}>删除</button>
        </li>
    )
}

export default TodoItem;