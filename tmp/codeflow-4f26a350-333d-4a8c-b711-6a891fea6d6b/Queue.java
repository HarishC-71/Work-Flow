public class Queue {
    static class queue{
        int []arr=new int[100];
        int front=0;
        int rear=-1;
        void enqueue(int x){
            arr[++rear]=x; 
        }
        int dequeue(){
            if(front>rear)return -1;
            return arr[front++];
        }
        int peek(){
            if(front>rear)return -1;
            return arr[front];
        }
        boolean isEmpty(){
            return rear==-1;
        }
    }
    public static void main(String[] args) {
        queue q=new queue();
        q.enqueue(10);
        q.enqueue(20);
        q.enqueue(30);
        System.out.println(q.dequeue());
        System.out.println(q.peek());
        System.out.println(q.isEmpty());
    }
}
