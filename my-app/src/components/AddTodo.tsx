import { useState } from "react";

interface AddTodoProps {
    addTodo: (text: string) => void; // 定义addTodo函数的类型
}

function AddTodo({addTodo}: AddTodoProps) {
    const [text, settext] = useState('')
    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (text.trim() === '') return; // 防止添加空任务
        // 调用父组件传递的addTodo函数
        addTodo(text);
        settext(''); // 清空输入框
    };
    return (
        <form onSubmit={handleSubmit}>
            <input type="text" value={text} placeholder="新建事项" onChange={(e) => settext(e.target.value)} />
            <button type="submit">新建</button>
        </form>
    );
}

export default AddTodo;