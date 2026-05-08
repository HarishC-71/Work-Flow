public class l {
    //create a node
    static class Node{
        int data;
        Node next;
        Node(int data){
            this.data=data;
        }
    }
    //insert at end
    public static Node insertEnd(Node head,int val){
        Node newNode=new Node(val);
        if(head==null)return newNode;
        Node temp=head;
        while(temp.next!=null){
            temp=temp.next;
        }
        temp.next=newNode;
        return head;
    }
    //delete Node by value
    public static Node deleteNode(Node head,int key){
        if(head==null)return null;
        if(head.data==key)return head.next;
        Node temp=head;
        while(temp.next!=null&&temp.next.data!=key){
            temp=temp.next;
        }
        if(temp.next!=null){
            temp.next=temp.next.next;
        }
        return head;
    }
    //Traverse/print
    public static void print(Node head){
        Node temp=head;
        while(temp!=null){
            System.out.print(temp.data+"->");
            temp=temp.next;
        }
        System.out.print("null");
    }
    //Reverse LinkedList
    public static Node reversList(Node head){
        Node prev=null;
        Node curr=head;
        while(curr!=null){
            Node temp=curr.next;
            curr.next=prev;
            prev=curr;
            curr=temp;
        }
        return prev;
    }
    //Find midddle
    public static Node middle(Node head){
        Node slow=head;
        Node fast=head;
        while(fast!=null&&fast.next!=null){
            slow=slow.next;
            fast=fast.next.next;
        }
        return slow;
    }
    //Detect Cycle
    public static boolean cycle(Node head){
        Node slow=head;
        Node fast=head;
        while(fast!=null&&fast.next!=null){
            slow=slow.next;
            fast=fast.next.next;
            if(slow==fast)return true;
        }
        return false;
    }
    public static void main(String[] args) {
        Node head=null;
        head=insertEnd(head, 10);
        head=insertEnd(head, 20);
        head=insertEnd(head, 30);
        head=insertEnd(head, 40);
        System.out.println("orginal list");
        print(head);
        System.out.println();
        head=deleteNode(head, 20);
        System.out.println("After deleting 20");
        print(head);
        System.out.println();
        head=reversList(head);
        System.out.println("reversed list");
        print(head);
        System.out.println();
        Node middle=middle(head);
        System.out.println("middle node:"+middle.data);
        System.out.println("cycle present:"+cycle(head));
    }
}
